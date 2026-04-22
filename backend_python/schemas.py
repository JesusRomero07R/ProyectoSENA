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
    id_rol_fk: int
    id_oficio_fk: Optional[int] = None

class UsuarioCreate(UsuarioBase):
    password: str

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    id_rol_fk: Optional[int] = None
    id_oficio_fk: Optional[int] = None
    estado: Optional[UserStatus] = None
    disponibilidad: Optional[UserAvailability] = None

class Usuario(UsuarioBase):
    id_usuario: int
    estado: UserStatus
    disponibilidad: UserAvailability

    class Config:
        from_attributes = True

# --- Proyectos ---
class ProyectoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    presupuesto: Optional[float] = None
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
    id_lider_fk: Optional[int] = None
    estado: Optional[ProyectoEstado] = None

class Proyecto(ProyectoBase):
    id_proyecto: int
    avance_general: float
    estado: ProyectoEstado
    id_operarios: List[int] = []

    @field_validator("id_operarios", mode="before")
    @classmethod
    def transform_operarios(cls, v, info):
        # Si v ya es una lista de enteros, lo dejamos así
        if isinstance(v, list) and all(isinstance(x, int) for x in v):
            return v
        
        # Si v es una lista de objetos (modelos Usuario), extraemos sus IDs
        if isinstance(v, list) and len(v) > 0 and hasattr(v[0], "id_usuario"):
            return [u.id_usuario for u in v]
        
        # Si v es None o vacío, intentamos buscarlo en el objeto original si estamos en validación de ORM
        # Nota: En Pydantic v2, podemos acceder al objeto original a través de validación de modelos,
        # pero para mantenerlo simple y compatible con el retorno de modelos SQLAlchemy:
        return v or []

    class Config:
        from_attributes = True

# --- Tareas ---
class TareaBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    prioridad: TareaPrioridad = TareaPrioridad.media
    fecha_limite: Optional[date] = None
    id_proyecto_fk: int

class TareaCreate(TareaBase):
    id_operarios: List[int] # Lista de IDs de operarios asignados

class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    prioridad: Optional[TareaPrioridad] = None
    fecha_limite: Optional[date] = None
    estado: Optional[TareaEstado] = None
    id_operarios: Optional[List[int]] = None

class Tarea(TareaBase):
    id_tarea: int
    estado: TareaEstado

    class Config:
        from_attributes = True

class TareaDetallada(BaseModel):
    id_tarea: int
    titulo: str
    descripcion: Optional[str] = None
    estado: TareaEstado
    avance: int = 0
    operarios_nombres: List[str] = []

    class Config:
        from_attributes = True

class TareaOperario(BaseModel):
    id_tarea: int
    titulo: str
    nombre_proyecto: str
    estado: TareaEstado

    class Config:
        from_attributes = True

# --- Reportes ---
class MaterialUsado(BaseModel):
    id_material: int
    cantidad: int

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

    class Config:
        from_attributes = True

# --- Otros ---
class OperarioEstado(BaseModel):
    id_usuario: int
    nombre: str
    apellido: str
    en_tarea: bool
    titulo_tarea: Optional[str] = None

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
    unidad_medida: str = "unidades"

class MaterialCreate(MaterialBase):
    pass

class Material(MaterialBase):
    id_material: int
    class Config:
        from_attributes = True

class InventarioGlobalBase(BaseModel):
    id_material_fk: int
    stock_actual: int
    unidad_medida: str

class InventarioGlobal(InventarioGlobalBase):
    id_inventario: int
    class Config:
        from_attributes = True

class InventarioProyecto(BaseModel):
    id_material_fk: int
    nombre_material: Optional[str] = None
    stock_actual: int
    unidad_medida: str

    class Config:
        from_attributes = True

# Esquema para listar materiales con su categoría (requiere relación en models)
class MaterialDetailed(Material):
    categoria_nombre: Optional[str] = None
