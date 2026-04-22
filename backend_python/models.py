from sqlalchemy import Column, Integer, String, ForeignKey, Text, Date, DateTime, Numeric, Float, Enum, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

# --- Enums ---
class UserStatus(str, enum.Enum):
    activo = "activo"
    inactivo = "inactivo"

class UserAvailability(str, enum.Enum):
    disponible = "disponible"
    ocupado = "ocupado"
    de_baja = "de_baja"

class ProyectoEstado(str, enum.Enum):
    activo = "activo"
    pausado = "pausado"
    finalizado = "finalizado"

class TareaEstado(str, enum.Enum):
    pendiente = "pendiente"
    en_progreso = "en_progreso"
    finalizada = "finalizada"

class TareaPrioridad(str, enum.Enum):
    baja = "baja"
    media = "media"
    alta = "alta"

# --- Tablas Asociativas ---

tareas_operarios = Table(
    "tareas_operarios",
    Base.metadata,
    Column("id_tarea", Integer, ForeignKey("tareas.id_tarea"), primary_key=True),
    Column("id_usuario", Integer, ForeignKey("usuarios.id_usuario"), primary_key=True),
)

proyectos_usuarios = Table(
    "proyectos_usuarios",
    Base.metadata,
    Column("id_proyecto", Integer, ForeignKey("proyectos.id_proyecto"), primary_key=True),
    Column("id_usuario", Integer, ForeignKey("usuarios.id_usuario"), primary_key=True),
)

# --- Tablas ---

class Rol(Base):
    __tablename__ = "roles"
    id_rol = Column(Integer, primary_key=True, index=True)
    nombre_rol = Column(String(50), unique=True, nullable=False)

class Oficio(Base):
    __tablename__ = "oficios"
    id_oficio = Column(Integer, primary_key=True, index=True)
    nombre_oficio = Column(String(50), unique=True, nullable=False)

class CategoriaMaterial(Base):
    __tablename__ = "categorias_material"
    id_categoria = Column(Integer, primary_key=True, index=True)
    nombre_categoria = Column(String(50), unique=True, nullable=False)

class Usuario(Base):
    __tablename__ = "usuarios"
    id_usuario = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    correo = Column(String(100), unique=True, nullable=False)
    telefono = Column(String(20))
    password_hash = Column(String(255), nullable=False)
    estado = Column(String(50), default="activo")
    disponibilidad = Column(String(50), default="disponible")
    id_rol_fk = Column(Integer, ForeignKey("roles.id_rol"))
    id_oficio_fk = Column(Integer, ForeignKey("oficios.id_oficio"), nullable=True)

    rol = relationship("Rol")
    oficio = relationship("Oficio")

class Proyecto(Base):
    __tablename__ = "proyectos"
    id_proyecto = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text)
    ciudad = Column(String(100))
    direccion = Column(String(255))
    presupuesto = Column(Numeric(12, 2))
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    avance_general = Column(Float, default=0.0)
    estado = Column(String(50), default="activo")
    id_lider_fk = Column(Integer, ForeignKey("usuarios.id_usuario"))

    lider = relationship("Usuario")
    operarios = relationship("Usuario", secondary=proyectos_usuarios)

    @property
    def id_operarios(self):
        """Retorna una lista de IDs de los operarios asignados para facilitar la serialización"""
        return [u.id_usuario for u in self.operarios] if self.operarios else []

class Tarea(Base):
    __tablename__ = "tareas"
    id_tarea = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text)
    estado = Column(String(50), default="pendiente")
    prioridad = Column(String(50), default="media")
    fecha_limite = Column(Date)
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"))

    proyecto = relationship("Proyecto")
    operarios = relationship("Usuario", secondary=tareas_operarios)

class ReporteAvance(Base):
    __tablename__ = "reportes_avance"
    id_reporte = Column(Integer, primary_key=True, index=True)
    id_tarea_fk = Column(Integer, ForeignKey("tareas.id_tarea"))
    id_operario_fk = Column(Integer, ForeignKey("usuarios.id_usuario"))
    fecha_reporte = Column(DateTime, server_default=func.now())
    porcentaje = Column(Integer, nullable=False)
    observaciones = Column(Text)
    foto_url = Column(String(500))
    horas_trabajadas = Column(Float, default=0.0)

class ReporteMaterial(Base):
    __tablename__ = "reportes_materiales"
    id_reporte_material = Column(Integer, primary_key=True, index=True)
    id_reporte_fk = Column(Integer, ForeignKey("reportes_avance.id_reporte"))
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    cantidad_usada = Column(Integer, nullable=False)

class Material(Base):
    __tablename__ = "materiales"
    id_material = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    id_categoria_fk = Column(Integer, ForeignKey("categorias_material.id_categoria"))
    stock_minimo = Column(Integer, default=0)
    unidad_medida = Column(String(20), default="unidades")

class InventarioGlobal(Base):
    __tablename__ = "inventario_global"
    id_inventario = Column(Integer, primary_key=True, index=True)
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    stock_actual = Column(Integer, default=0)
    unidad_medida = Column(String(20))

class InventarioProyecto(Base):
    __tablename__ = "inventario_proyecto"
    id_inv_proy = Column(Integer, primary_key=True, index=True)
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"))
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    stock_actual = Column(Integer, default=0)
    unidad_medida = Column(String(20))

    material = relationship("Material")

class MaterialAsignado(Base):
    __tablename__ = "materiales_asignados"
    id_asignacion = Column(Integer, primary_key=True, index=True)
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"))
    cantidad_asignada = Column(Integer, nullable=False)
    cantidad_usada = Column(Integer, default=0)

class SolicitudMaterial(Base):
    __tablename__ = "solicitudes_material"
    id_solicitud = Column(Integer, primary_key=True, index=True)
    descripcion = Column(Text)
    fecha_solicitud = Column(Date, server_default=func.current_date())
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"))
    id_lider_fk = Column(Integer, ForeignKey("usuarios.id_usuario"))
    estado = Column(String(50), default="pendiente")

class MovimientoInventario(Base):
    __tablename__ = "movimientos_inventario"
    id_movimiento = Column(Integer, primary_key=True, index=True)
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    id_usuario_fk = Column(Integer, ForeignKey("usuarios.id_usuario"))
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"), nullable=True)
    tipo_movimiento = Column(String(50), nullable=False)
    cantidad = Column(Integer, nullable=False)
    fecha_movimiento = Column(DateTime, server_default=func.now())

class ArchivoProyecto(Base):
    __tablename__ = "archivos_proyecto"
    id_archivo = Column(Integer, primary_key=True, index=True)
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"), nullable=True)
    id_tarea_fk = Column(Integer, ForeignKey("tareas.id_tarea"), nullable=True)
    id_reporte_fk = Column(Integer, ForeignKey("reportes_avance.id_reporte"), nullable=True)
    id_usuario_fk = Column(Integer, ForeignKey("usuarios.id_usuario"))
    nombre_original = Column(String(255), nullable=False)
    nombre_archivo = Column(String(255), nullable=False)
    tipo_mime = Column(String(50), nullable=False)
    ruta_url = Column(String(500), nullable=False)
    tamanio_bytes = Column(Integer, nullable=False)
    fecha_subida = Column(DateTime, server_default=func.now())
