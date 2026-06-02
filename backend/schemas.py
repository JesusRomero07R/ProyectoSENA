from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import date, datetime
from models import UserStatus, UserAvailability, ProyectoEstado, TareaEstado, TareaPrioridad

# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[int] = None

# --- Usuarios ---
class UsuarioBase(BaseModel):
    nombre: str
    apellido: str
    correo: EmailStr
    telefono: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    password: str
    id_rol_fk: int

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    password: Optional[str] = None
    id_rol_fk: Optional[int] = None
    id_oficio_fk: Optional[int] = None
    estado: Optional[UserStatus] = None
    disponibilidad: Optional[UserAvailability] = None
    activo: Optional[bool] = None

class Usuario(UsuarioBase):
    id_rol_fk: int
    id_oficio_fk: Optional[int] = None
    id_usuario: int
    estado: UserStatus
    disponibilidad: UserAvailability
    activo: bool

    class Config:
        from_attributes = True

class UsuarioDetallado(Usuario):
    tareas_totales: int = 0
    tareas_completadas: int = 0
    proyectos_activos: int = 0
    rendimiento: float = 0.0

# --- Proyectos ---
class ProyectoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    ciudad: str
    direccion: str
    presupuesto: float
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    id_lider_fk: int

class ProyectoCreate(ProyectoBase):
    pass

class ProyectoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    presupuesto: Optional[float] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[ProyectoEstado] = None

class Proyecto(ProyectoBase):
    id_proyecto: int
    avance_general: float
    estado: ProyectoEstado
    id_operarios: List[int] = []
    lider: Optional[Usuario] = None

    class Config:
        from_attributes = True

# --- Tareas ---
class TareaBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    estado: TareaEstado = TareaEstado.pendiente
    prioridad: TareaPrioridad = TareaPrioridad.media
    fecha_limite: Optional[date] = None
    id_proyecto_fk: int

class TareaCreate(TareaBase):
    id_operarios: List[int] = []

class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[TareaEstado] = None
    prioridad: Optional[TareaPrioridad] = None
    avance: Optional[int] = None
    id_usuario_finalizado_fk: Optional[int] = None

class Tarea(TareaBase):
    id_tarea: int
    avance: int
    id_usuario_finalizado_fk: Optional[int] = None

    class Config:
        from_attributes = True

class TareaDetallada(BaseModel):
    id_tarea: int
    titulo: str
    descripcion: Optional[str] = None
    estado: TareaEstado
    avance: int = 0
    prioridad: TareaPrioridad
    operarios_nombres: List[str] = []
    finalizador_nombre: Optional[str] = None

    class Config:
        from_attributes = True

class TareaOperario(BaseModel):
    id_tarea: int
    titulo: str
    id_proyecto_fk: int
    nombre_proyecto: str
    estado: TareaEstado
    avance: int
    prioridad: TareaPrioridad

    class Config:
        from_attributes = True

# --- Reportes ---
class MaterialUsado(BaseModel):
    id_material: int
    cantidad: int

class ReporteMaterialDetailed(BaseModel):
    nombre_material: str
    cantidad_usada: int
    unidad_medida: str

    class Config:
        from_attributes = True

class ReporteAvanceBase(BaseModel):
    id_tarea_fk: int
    porcentaje: int
    observaciones: Optional[str] = None
    foto_url: Optional[str] = None
    horas_trabajadas: float = 0.0

class ReporteAvanceCreate(ReporteAvanceBase):
    materiales_usados: List[MaterialUsado] = []

class ReporteAvance(ReporteAvanceBase):
    id_reporte: int
    id_operario_fk: int
    fecha_reporte: datetime
    materiales_detalles: List[ReporteMaterialDetailed] = []

    class Config:
        from_attributes = True

class TareaDetalleOperario(TareaOperario):
    horas_totales: float = 0.0
    materiales_totales: List[ReporteMaterialDetailed] = []
    historial_reportes: List[ReporteAvance] = []

# --- Otros ---
class OperarioEstado(BaseModel):
    id_usuario: int
    nombre: str
    apellido: str
    en_tarea: bool
    tareas_activas: List[str] = []

    class Config:
        from_attributes = True

class Notificacion(BaseModel):
    id_notificacion: int
    titulo: str
    mensaje: str
    tipo: str
    leida: bool
    fecha_creacion: datetime
    class Config:
        from_attributes = True

class EquipoProyecto(BaseModel):
    id_proyecto: int
    id_usuarios: List[int]

class ProyectoEquipoDetalle(BaseModel):
    id_proyecto: int
    nombre_proyecto: str
    nombre_lider: str
    operarios_nombres: List[str]

    class Config:
        from_attributes = True

class TrasladoMaterial(BaseModel):
    id_proyecto: int
    id_material: int
    cantidad: int

# --- Materiales e Inventario ---
class CategoriaMaterialBase(BaseModel):
    nombre_categoria: str

class CategoriaMaterialCreate(CategoriaMaterialBase):
    pass

class CategoriaMaterial(CategoriaMaterialBase):
    id_categoria: int
    class Config:
        from_attributes = True

class MaterialBase(BaseModel):
    nombre: str
    id_categoria_fk: int
    stock_minimo: int = 0
    unidad_medida: str

class MaterialCreate(MaterialBase):
    pass

class Material(MaterialBase):
    id_material: int
    class Config:
        from_attributes = True

class MaterialDetailed(Material):
    categoria_nombre: str

class InventarioGlobalDetailed(BaseModel):
    id_material_fk: int
    stock_actual: int
    unidad_medida: str
    id_inventario: int
    nombre_material: str
    stock_minimo: int
    categoria_nombre: str

    class Config:
        from_attributes = True

class InventarioGlobal(BaseModel):
    id_inventario: int
    id_material_fk: int
    stock_actual: int
    unidad_medida: str

    class Config:
        from_attributes = True

class InventarioProyecto(BaseModel):
    id_material_fk: int
    nombre_material: str
    stock_actual: int
    unidad_medida: str
    categoria_nombre: str

    class Config:
        from_attributes = True

class PasswordRecoveryRequest(BaseModel):
    username: str

class ReporteAvanceDetailed(ReporteAvance):
    nombre_proyecto: Optional[str] = None
    titulo_tarea: Optional[str] = None
    nombre_operario: Optional[str] = None
