document.addEventListener("DOMContentLoaded", () => {

    //=====================================================
    // DOCUMENTOS DEL VEHÍCULO
    //=====================================================

    const documentos = [

        {
            nombre: "Padrón",
            icono: "bi-file-earmark-text",
            archivo: "documentos/padron.pdf",
            vence: null
        },

        {
            nombre: "Permiso de Circulación",
            icono: "bi-car-front-fill",
            archivo: "documentos/permiso circulacion.pdf",
            vence: "2026-08-31"
        },

        {
            nombre: "Seguro Obligatorio (SOAP)",
            icono: "bi-shield-check",
            archivo: "documentos/seguro obligatoro 2026.pdf",
            vence: "2027-03-31"
        },

        {
            nombre: "Revisión Técnica",
            icono: "bi-tools",
            archivo: "documentos/revision.pdf",
            vence: "2027-03-31"
        }

    ];

    //-----------------------------------------------------
    // CONTENEDOR
    //-----------------------------------------------------

    const contenedor = document.getElementById("lista-documentos");

    let total = documentos.length;
    let vigentes = 0;
    let proximos = 0;
    let vencidos = 0;

    //-----------------------------------------------------
    // GENERAR TARJETAS
    //-----------------------------------------------------

    documentos.forEach((documento, indice) => {

        const tarjeta = document.createElement("div");
        tarjeta.className = "tarjeta";

        // estado inicial (animación)
        tarjeta.style.opacity = "0";
        tarjeta.style.transform = "translateY(18px)";
        tarjeta.style.transition = "all .5s ease";

        let html = `
            <h2>
                <i class="bi ${documento.icono}"></i>
                ${documento.nombre}
            </h2>
        `;

        //-------------------------------------------------
        // VALIDACIÓN DE VENCIMIENTO
        //-------------------------------------------------

        if (documento.vence) {

            const fechaVence = new Date(documento.vence + "T23:59:59");

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

            }
            else if (dias >= 0) {

                proximos++;
                claseEstado = "aviso";
                iconoEstado = "bi-clock-fill";

                estadoTexto = `
                    <strong>Próximo a vencer</strong><br>
                    Restan <strong>${dias}</strong> días<br>
                    <small>Vence el ${fechaBonita}</small>
                `;

            }
            else {

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

        //-------------------------------------------------
        // BOTÓN
        //-------------------------------------------------

        html += `
            <a href="${documento.archivo}" target="_blank">
                <i class="bi bi-eye-fill"></i>
                Ver documento
            </a>
        `;

        tarjeta.innerHTML = html;
        contenedor.appendChild(tarjeta);

        //-------------------------------------------------
        // ANIMACIÓN SUAVE
        //-------------------------------------------------

        requestAnimationFrame(() => {
            setTimeout(() => {
                tarjeta.style.opacity = "1";
                tarjeta.style.transform = "translateY(0)";
            }, indice * 90);
        });

    });

    //-----------------------------------------------------
    // DASHBOARD
    //-----------------------------------------------------

    const setNumber = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;

        // animación simple de conteo
        let current = 0;
        const step = Math.ceil(value / 10);

        const interval = setInterval(() => {
            current += step;
            if (current >= value) {
                current = value;
                clearInterval(interval);
            }
            el.textContent = current;
        }, 30);
    };

    setNumber("totalDocs", total);
    setNumber("vigentesDocs", vigentes);
    setNumber("proximosDocs", proximos);
    setNumber("vencidosDocs", vencidos);

    //-----------------------------------------------------
    // FECHA ÚLTIMA ACTUALIZACIÓN
    //-----------------------------------------------------

    const hoy = new Date();

    const fechaActual = hoy.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    const fechaEl = document.getElementById("ultimaActualizacion");
    if (fechaEl) {
        fechaEl.textContent = fechaActual;
    }

});