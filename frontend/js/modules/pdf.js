import { API_URL, fetchJSON } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';

export async function exportarProyectoPDF(idProyecto) {
    try {
        console.log("Generando reporte detallado para el proyecto ID:", idProyecto);
        const res = await fetch(`${API_URL}/proyectos/${idProyecto}/reporte-detallado`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            alert("Error al cargar reporte: " + (err.detail || "No autorizado"));
            return;
        }
        const p = await res.json();
        
        // Generar ventana de impresión
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("El navegador bloqueó la ventana emergente. Por favor permita las ventanas emergentes para este sitio.");
            return;
        }
        
        // Formatear tablas y listas
        const operariosHTML = p.operarios.length 
            ? `<table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Correo</th>
                        <th>Teléfono</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.operarios.map(o => `
                        <tr>
                            <td>${o.nombre_completo}</td>
                            <td>${o.correo}</td>
                            <td>${o.telefono}</td>
                        </tr>
                    `).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No hay operarios asignados a este proyecto.</p>`;

        const inventarioHTML = p.inventario.length
            ? `<table>
                <thead>
                    <tr>
                        <th>Material</th>
                        <th>Cantidad en Obra</th>
                        <th>Unidad</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.inventario.map(i => `
                        <tr>
                            <td>${i.nombre_material}</td>
                            <td>${i.stock_actual}</td>
                            <td>${i.unidad_medida}</td>
                        </tr>
                    `).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No hay materiales en el inventario de esta obra.</p>`;

        const tareasHTML = p.tareas.length
            ? `<table>
                <thead>
                    <tr>
                        <th>Tarea</th>
                        <th>Prioridad</th>
                        <th>Avance</th>
                        <th>Estado</th>
                        <th>Asignados</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.tareas.map(t => {
                        let badgeClass = 'badge-pending';
                        if (t.estado === 'finalizada') badgeClass = 'badge-finalized';
                        return `
                            <tr>
                                <td><strong>${t.titulo}</strong><br><small>${t.descripcion}</small></td>
                                <td><span class="badge">${t.prioridad}</span></td>
                                <td>${t.avance}%</td>
                                <td><span class="badge ${badgeClass}">${t.estado}</span></td>
                                <td>${t.operarios_nombres.join(', ') || 'Sin asignar'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No hay tareas creadas para este proyecto.</p>`;

        const reportesHTML = p.reportes_avance.length
            ? `<table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Operario</th>
                        <th>Tarea</th>
                        <th>Avance</th>
                        <th>Observaciones</th>
                        <th>Materiales Reportados</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.reportes_avance.map(r => {
                        const mats = r.materiales_usados.map(m => `${m.nombre_material} (${m.cantidad_usada} ${m.unidad_medida})`).join('<br>') || 'Ninguno';
                        return `
                            <tr>
                                <td>${new Date(r.fecha_reporte).toLocaleDateString()}</td>
                                <td>${r.nombre_operario}</td>
                                <td>${r.titulo_tarea}</td>
                                <td>${r.porcentaje}%</td>
                                <td>${r.observaciones}</td>
                                <td>${mats}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No se han registrado reportes de avance para este proyecto.</p>`;

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Obra - ${p.nombre}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #1e293b;
                        margin: 40px;
                        font-size: 13px;
                        line-height: 1.5;
                        background: #fff;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 3px solid #0f172a;
                        padding-bottom: 10px;
                        margin-bottom: 25px;
                    }
                    .brand-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #0f172a;
                    }
                    .report-title {
                        font-size: 14px;
                        color: #64748b;
                        text-align: right;
                    }
                    .section-title {
                        font-size: 14px;
                        font-weight: bold;
                        color: #0f172a;
                        border-bottom: 1px solid #cbd5e1;
                        padding-bottom: 5px;
                        margin-top: 25px;
                        margin-bottom: 10px;
                        text-transform: uppercase;
                    }
                    .project-desc {
                        margin-bottom: 20px;
                        padding: 12px;
                        background: #f8fafc;
                        border-left: 4px solid #0284c7;
                        border-radius: 0 6px 6px 0;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px 20px;
                        background-color: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 15px;
                        border-radius: 6px;
                        margin-bottom: 20px;
                    }
                    .meta-item {
                        display: flex;
                        justify-content: space-between;
                    }
                    .meta-label {
                        font-weight: 600;
                        color: #475569;
                    }
                    .meta-value {
                        color: #0f172a;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        border: 1px solid #e2e8f0;
                        padding: 8px 10px;
                        text-align: left;
                    }
                    th {
                        background-color: #f1f5f9;
                        font-weight: 600;
                        color: #475569;
                    }
                    tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    .badge {
                        display: inline-block;
                        padding: 2px 6px;
                        font-size: 11px;
                        font-weight: 600;
                        border-radius: 4px;
                        text-transform: uppercase;
                    }
                    .badge-active { background-color: #dcfce7; color: #15803d; }
                    .badge-pending { background-color: #fef9c3; color: #a16207; }
                    .badge-finalized { background-color: #e2e8f0; color: #475569; }
                    .no-data {
                        text-align: center;
                        color: #64748b;
                        font-style: italic;
                        padding: 15px;
                        border: 1px dashed #cbd5e1;
                        border-radius: 6px;
                    }
                    @media print {
                        body { margin: 20px; }
                        .no-print { display: none; }
                        .page-break { page-break-before: always; }
                        tr { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="brand-name">Constructora GG</div>
                    <div class="report-title">
                        <strong>Informe Ejecutivo de Proyecto</strong><br>
                        Fecha Emisión: ${new Date().toLocaleDateString()}<br>
                        Generado por: Plataforma GG
                    </div>
                </div>

                <div class="section-title">Detalles del Proyecto</div>
                <div class="project-desc">
                    <strong>${p.nombre}</strong><br>
                    ${p.descripcion}
                </div>

                <div class="meta-grid">
                    <div class="meta-item"><span class="meta-label">Estado:</span><span class="meta-value">${p.estado.toUpperCase()}</span></div>
                    <div class="meta-item"><span class="meta-label">Avance General:</span><span class="meta-value">${p.avance_general}%</span></div>
                    <div class="meta-item"><span class="meta-label">Ciudad:</span><span class="meta-value">${p.ciudad}</span></div>
                    <div class="meta-item"><span class="meta-label">Dirección:</span><span class="meta-value">${p.direccion}</span></div>
                    <div class="meta-item"><span class="meta-label">Líder Asignado:</span><span class="meta-value">${p.lider_nombre}</span></div>
                    <div class="meta-item"><span class="meta-label">Presupuesto:</span><span class="meta-value">$${p.presupuesto.toLocaleString()}</span></div>
                    <div class="meta-item"><span class="meta-label">Fecha Inicio:</span><span class="meta-value">${p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString() : 'No definida'}</span></div>
                    <div class="meta-item"><span class="meta-label">Fecha Fin:</span><span class="meta-value">${p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString() : 'No definida'}</span></div>
                    <div class="meta-item"><span class="meta-label">Total Horas Hombre:</span><span class="meta-value">${p.total_horas_trabajadas} hrs</span></div>
                </div>

                <div class="section-title">Personal Asignado (Equipo)</div>
                ${operariosHTML}

                <div class="page-break"></div>

                <div class="section-title">Inventario en Obra</div>
                ${inventarioHTML}

                <div class="section-title">Control de Tareas</div>
                ${tareasHTML}

                <div class="page-break"></div>

                <div class="section-title">Historial de Avances y Novedades</div>
                ${reportesHTML}

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    } catch (e) {
        console.error("Error al exportar PDF:", e);
        alert("Error de conexión al generar el reporte en PDF.");
    }
}

