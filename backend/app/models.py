from sqlalchemy import Column, Integer, String, ForeignKey, Text, Date, DateTime, Numeric, Float, Enum, Table, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

# Tablas Intermedias (N:N)
proyectos_usuarios = Table(
    "proyectos_usuarios",
    Base.metadata,
    Column("id_proyecto", Integer, ForeignKey("proyectos.id_proyecto"), primary_key=True),
    Column("id_usuario", Integer, ForeignKey("usuarios.id_usuario"), primary_key=True)
)

tareas_operarios = Table(
    "tareas_operarios",
    Base.metadata,
    Column("id_tarea", Integer, ForeignKey("tareas.id_tarea"), primary_key=True),
    Column("id_usuario", Integer, ForeignKey("usuarios.id_usuario"), primary_key=True)
)

# Enums
class UserStatus(str, enum.Enum):
    activo = "activo"
    inactivo = "inactivo"
    vacaciones = "vacaciones"
    licencia = "licencia"

class UserAvailability(str, enum.Enum):
    disponible = "disponible"
    ocupado = "ocupado"

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

# Modelos
class Rol(Base):
    __tablename__ = "roles"
    id_rol = Column(Integer, primary_key=True, index=True)
    nombre_rol = Column(String(50), unique=True, nullable=False)

class Usuario(Base):
    __tablename__ = "usuarios"
    id_usuario = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    correo = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    telefono = Column(String(20))
    id_rol_fk = Column(Integer, ForeignKey("roles.id_rol"))
    estado = Column(String(50), default="activo")
    disponibilidad = Column(String(50), default="disponible")
    activo = Column(Boolean, default=True)

    rol = relationship("Rol")

class Proyecto(Base):
    __tablename__ = "proyectos"
    id_proyecto = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text)
    ciudad = Column(String(100))
    direccion = Column(String(255))
    presupuesto = Column(Numeric(15, 2))
    fecha_inicio = Column(Date, server_default=func.current_date())
    fecha_fin = Column(Date)
    estado = Column(String(50), default="activo")
    id_lider_fk = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)

    lider = relationship("Usuario")
    operarios = relationship("Usuario", secondary=proyectos_usuarios)

class Tarea(Base):
    __tablename__ = "tareas"
    id_tarea = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text)
    estado = Column(String(50), default="pendiente")
    prioridad = Column(String(50), default="media")
    fecha_limite = Column(Date)
    avance = Column(Integer, default=0) # Porcentaje de avance
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"))
    id_usuario_finalizado_fk = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=True)

    proyecto = relationship("Proyecto")
    finalizador = relationship("Usuario", foreign_keys=[id_usuario_finalizado_fk])
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

    materiales_detalles = relationship("ReporteMaterial", back_populates="reporte")

class ReporteMaterial(Base):
    __tablename__ = "reportes_materiales"
    id_reporte_material = Column(Integer, primary_key=True, index=True)
    id_reporte_fk = Column(Integer, ForeignKey("reportes_avance.id_reporte"))
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    cantidad_usada = Column(Integer, nullable=False)

    reporte = relationship("ReporteAvance", back_populates="materiales_detalles")
    material = relationship("Material")

    @property
    def nombre_material(self) -> str:
        return self.material.nombre if self.material else ""

    @property
    def unidad_medida(self) -> str:
        return self.material.unidad_medida if self.material else ""

class CategoriaMaterial(Base):
    __tablename__ = "categorias_material"
    id_categoria = Column(Integer, primary_key=True, index=True)
    nombre_categoria = Column(String(100), unique=True, nullable=False)

class Material(Base):
    __tablename__ = "materiales"
    id_material = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    id_categoria_fk = Column(Integer, ForeignKey("categorias_material.id_categoria"), nullable=False)
    stock_minimo = Column(Integer, default=0)
    unidad_medida = Column(String(20), nullable=False) 

    categoria = relationship("CategoriaMaterial")

class InventarioGlobal(Base):
    __tablename__ = "inventario_global"
    id_inventario = Column(Integer, primary_key=True, index=True)
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    stock_actual = Column(Integer, default=0)
    unidad_medida = Column(String(20), nullable=False)

class InventarioProyecto(Base):
    __tablename__ = "inventario_proyecto"
    id_inv_proy = Column(Integer, primary_key=True, index=True)
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"))
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    stock_actual = Column(Integer, default=0)
    unidad_medida = Column(String(20))

    material = relationship("Material")

class SolicitudMaterial(Base):
    __tablename__ = "solicitudes_material"
    id_solicitud = Column(Integer, primary_key=True, index=True)
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"))
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"))
    cantidad_solicitada = Column(Integer, nullable=False)
    estado_solicitud = Column(String(50), default="pendiente") # pendiente, aprobado, rechazado, insuficiente
    fecha_solicitud = Column(DateTime, server_default=func.now())

class Notificacion(Base):
    __tablename__ = "notificaciones"
    id_notificacion = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    mensaje = Column(Text, nullable=False)
    tipo = Column(String(50)) # 'alarma_stock', 'aviso'
    leida = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, server_default=func.now())
    id_material_fk = Column(Integer, ForeignKey("materiales.id_material"), nullable=True)
    stock_actual = Column(Integer, nullable=True)
    unidad_medida = Column(String(20), nullable=False, default="unid") # Match DB NOT NULL constraint

class ArchivoProyecto(Base):
    __tablename__ = "archivos_proyecto"
    id_archivo = Column(Integer, primary_key=True, index=True)
    id_proyecto_fk = Column(Integer, ForeignKey("proyectos.id_proyecto"), nullable=True)
    id_tarea_fk = Column(Integer, ForeignKey("tareas.id_tarea"), nullable=True)
    nombre_archivo = Column(String(255), nullable=False)
    tipo_mime = Column(String(50), nullable=False)
    ruta_url = Column(String(500), nullable=False)
    tamanio_bytes = Column(Integer, nullable=False)
    fecha_subida = Column(DateTime, server_default=func.now())
