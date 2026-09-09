import { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, ChevronRight, FileSpreadsheet, HelpCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { RUBROS_LABELS, RUBROS_LIST } from '../data/rubros';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CampoDestino = 'email' | 'empresa_nombre' | 'cuit' | 'rubro_id' | 'tipo' | 'estado' | '_ignorar';

interface MappedColumn {
  colOriginal: string;
  campoDestino: CampoDestino;
}

interface ContactoImportRow {
  email: string;
  empresa_nombre?: string | null;
  cuit?: string | null;
  rubro_id?: string | null;
  tipo?: string | null;
  estado?: string | null;
}

interface Props {
  onClose: () => void;
  onImportComplete: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEURISTICS: auto-detect columns
// ─────────────────────────────────────────────────────────────────────────────

const HEURISTICS: Record<CampoDestino, string[]> = {
  email:          ['email', 'mail', 'e-mail', 'correo', 'correo electronico'],
  empresa_nombre: ['empresa', 'razon social', 'razón social', 'nombre', 'company', 'compania'],
  cuit:           ['cuit', 'cuil', 'id fiscal', 'rut'],
  rubro_id:       ['rubro', 'sector', 'industria', 'actividad'],
  tipo:           ['tipo', 'type', 'contacto tipo', 'nivel'],
  estado:         ['estado', 'status', 'activo', 'active'],
  _ignorar:       [],
};

function autoDetect(col: string): CampoDestino {
  const lower = col.toLowerCase().trim();
  for (const [campo, keywords] of Object.entries(HEURISTICS) as [CampoDestino, string[]][]) {
    if (campo === '_ignorar') continue;
    if (keywords.some(kw => lower.includes(kw))) return campo;
  }
  return '_ignorar';
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE VALUES
// Reglas:
//   - Todo se normaliza a minúsculas antes de comparar
//   - Separadores como _ - / y espacios son equivalentes
//   - Valores no reconocidos → null (campos opcionales) o 'funcional' (estado)
// ─────────────────────────────────────────────────────────────────────────────

/** Canonicaliza un string: minúsculas, quita acentos y reemplaza _ - / por espacio */
function canonical(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .replace(/[_\-\/]+/g, ' ')        // _ - / → espacio
    .replace(/\s+/g, ' ')             // múltiples espacios → uno
    .trim();
}

function normalizarRubro(raw: string): string | null {
  if (!raw) return null;
  const c = canonical(raw);
  // match exacto sobre clave
  if (RUBROS_LIST.includes(c)) return c;
  // match sobre label (ej: 'Metalúrgica' → 'metalurgica')
  for (const [key, label] of Object.entries(RUBROS_LABELS)) {
    if (canonical(label) === c) return key;
  }
  // match parcial: 'metalurg' dentro de 'metalurgica' o viceversa
  for (const rubro of RUBROS_LIST) {
    if (c.includes(rubro) || rubro.includes(c)) return rubro;
  }
  return null; // rubro desconocido → null, no se guarda nada
}

function normalizarTipo(raw: string): string {
  if (!raw) return 'principal';
  const c = canonical(raw);
  if (c.includes('secundario') || c.includes('secundaria')) return 'secundario';
  return 'principal'; // tipo desconocido o vacío → principal por defecto
}

/** Estados válidos internos */
const ESTADOS_VALIDOS = [
  'funcional',
  'inactivo',
  'rebotado inexistente',
  'rebotado bandeja llena',
  'rebotado spam',
  'rebotado desconocido',
] as const;
type EstadoValido = typeof ESTADOS_VALIDOS[number];

function normalizarEstado(raw: string): EstadoValido {
  if (!raw) return 'funcional';
  const c = canonical(raw);

  // Match exacto primero (ej: 'funcional', 'inactivo')
  if (c === 'funcional' || c === 'activo' || c === 'active') return 'funcional';
  if (c === 'inactivo' || c === 'inactive') return 'inactivo';

  // Match sobre estados compuestos rebotado
  if (c.includes('rebotado') || c.includes('rebotad') || c.includes('bounce') || c.includes('bounced')) {
    if (c.includes('inexistente') || c.includes('inexistent') || c.includes('noexiste')) return 'rebotado inexistente';
    if (c.includes('bandeja') || c.includes('llena') || c.includes('full') || c.includes('quota')) return 'rebotado bandeja llena';
    if (c.includes('spam') || c.includes('span') || c.includes('junk')) return 'rebotado spam'; // "span" = typo de "spam"
    if (c.includes('desconocido') || c.includes('unknown') || c.includes('error')) return 'rebotado desconocido';
    return 'rebotado desconocido'; // rebotado genérico
  }

  // error_formato y otros estados de error desconocidos → rebotado desconocido
  if (c.includes('error') || c.includes('formato') || c.includes('invalid')) return 'rebotado desconocido';

  return 'funcional'; // fallback seguro
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const PASOS = ['Subir Archivo', 'Mapear Columnas', 'Importar'] as const;
type Paso = 0 | 1 | 2;

const CAMPO_LABELS: Record<CampoDestino, string> = {
  email:          '✉ Email (requerido)',
  empresa_nombre: '🏢 Empresa',
  cuit:           '🔢 CUIT',
  rubro_id:       '🏭 Rubro',
  tipo:           '🔖 Tipo (Principal/Secundario)',
  estado:         '📋 Estado',
  _ignorar:       '— Ignorar columna',
};

export default function ImportadorVisual({ onClose, onImportComplete }: Props) {
  const [paso, setPaso] = useState<Paso>(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [mappings, setMappings] = useState<MappedColumn[]>([]);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ procesados: number; insertados_o_actualizados: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // ── Parse ──────────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    setFileName(file.name);
    setErrorMsg('');

    if (ext === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data, meta }) => {
          const cols = meta.fields ?? [];
          setRows(data);
          setMappings(cols.map(c => ({ colOriginal: c, campoDestino: autoDetect(c) })));
          setPaso(1);
        },
        error: (err) => setErrorMsg('Error al leer el CSV: ' + err.message),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array' });
          
          let bestSheetName = wb.SheetNames[0];
          let maxTotalMatches = -1;
          let bestHeaderRowIndex = 0;
          
          const knownKeywords = ['email', 'mail', 'empresa', 'cuit', 'rubro', 'estado', 'tipo'];

          // Buscar en todas las hojas cuál es la que tiene más columnas conocidas (la verdadera base de datos)
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
            
            let currentSheetMaxMatches = 0;
            let currentSheetHeaderIndex = 0;

            for (let i = 0; i < Math.min(rawData.length, 20); i++) {
               const row = rawData[i];
               if (!Array.isArray(row)) continue;
               
               let matches = 0;
               row.forEach(cell => {
                 const str = String(cell).toLowerCase();
                 if (knownKeywords.some(kw => str.includes(kw))) matches++;
               });
               
               if (matches > currentSheetMaxMatches) {
                 currentSheetMaxMatches = matches;
                 currentSheetHeaderIndex = i;
               }
            }

            if (currentSheetMaxMatches > maxTotalMatches) {
               maxTotalMatches = currentSheetMaxMatches;
               bestSheetName = sheetName;
               bestHeaderRowIndex = currentSheetHeaderIndex;
            }
          }

          // Parsear la mejor hoja encontrada usando la fila detectada como cabecera
          const ws = wb.Sheets[bestSheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { range: bestHeaderRowIndex, defval: '' });
          
          if (!jsonData.length) { setErrorMsg('El archivo Excel está vacío o no se encontraron datos válidos en ninguna hoja.'); return; }
          const cols = Object.keys(jsonData[0]);
          setRows(jsonData);
          setMappings(cols.map(c => ({ colOriginal: c, campoDestino: autoDetect(c) })));
          setPaso(1);
        } catch {
          setErrorMsg('Error al leer el Excel. Verificá que el archivo no esté corrupto.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrorMsg('Formato no soportado. Usá .csv, .xlsx o .xls');
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  // ── Build contacts ─────────────────────────────────────────────────────────

  const buildContactos = (): ContactoImportRow[] => {
    // Construir contactos y deduplicar por email (último gana, con aviso)
    const contactosRaw = rows.map(row => {
      const contact: ContactoImportRow = { email: '' };
      for (const m of mappings) {
        if (m.campoDestino === '_ignorar') continue;
        const val = String(row[m.colOriginal] ?? '').trim();
        if (m.campoDestino === 'email') contact.email = val.toLowerCase().trim();
        else if (m.campoDestino === 'empresa_nombre') contact.empresa_nombre = val || null;
        else if (m.campoDestino === 'cuit') contact.cuit = val.replace(/\D/g, '') || null;
        else if (m.campoDestino === 'rubro_id') contact.rubro_id = normalizarRubro(val);
        else if (m.campoDestino === 'tipo') contact.tipo = normalizarTipo(val);
        else if (m.campoDestino === 'estado') contact.estado = normalizarEstado(val);
      }
      return contact;
    }).filter(c => c.email.includes('@'));

    // Deduplicar: si el mismo email aparece varias veces en el archivo,
    // se queda con la ÚLTIMA ocurrencia (Map preserva el último valor)
    const emailMap = new Map<string, ContactoImportRow>();
    for (const c of contactosRaw) emailMap.set(c.email, c);
    return Array.from(emailMap.values());
  };

  // Cantidad de emails duplicados en el archivo (solo informativo)
  const emailsDuplicados = (() => {
    if (paso < 1) return 0;
    const emails = rows
      .map(row => {
        const emailCol = mappings.find(m => m.campoDestino === 'email');
        if (!emailCol) return '';
        return String(row[emailCol.colOriginal] ?? '').toLowerCase().trim();
      })
      .filter(e => e.includes('@'));
    return emails.length - new Set(emails).size;
  })();

  const validados = paso >= 1 ? buildContactos() : [];
  const emailsMapped = mappings.some(m => m.campoDestino === 'email');

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    setErrorMsg('');
    const contactos = buildContactos();
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/contactos/import-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ contactos }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setPaso(2);
        onImportComplete();
      } else {
        setErrorMsg(json.error?.message || 'Error al importar.');
      }
    } catch {
      setErrorMsg('Error de red al importar.');
    } finally {
      setImporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh] relative">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-dark flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-primary" />
              Importador Visual de Contactos
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {PASOS.map((label, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold transition-colors ${i === paso ? 'bg-primary text-white' : i < paso ? 'bg-green-500 text-white' : 'bg-border text-muted'}`}>
                    {i < paso ? '✓' : i + 1}
                  </span>
                  <span className={`text-xs font-medium ${i === paso ? 'text-primary' : i < paso ? 'text-green-600' : 'text-muted'}`}>{label}</span>
                  {i < PASOS.length - 1 && <ChevronRight size={14} className="text-muted" />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(true)}
              className="text-muted hover:text-primary transition-colors p-1 rounded-lg hover:bg-primary/10"
              title="Ayuda sobre el importador"
            >
              <HelpCircle size={20} />
            </button>
            <button onClick={onClose} className="text-muted hover:text-dark transition-colors p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal de Ayuda */}
        {showHelp && (
          <div className="absolute inset-0 z-10 bg-surface/95 backdrop-blur-sm rounded-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-dark flex items-center gap-2">
                  <HelpCircle size={20} className="text-primary" />
                  Guía del Importador
                </h3>
                <button onClick={() => setShowHelp(false)} className="text-muted hover:text-dark transition-colors p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5 text-sm">

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="font-semibold text-blue-800 mb-2">📄 ¿Qué archivos puedo subir?</p>
                  <p className="text-blue-700">Podés subir archivos <strong>.CSV</strong> o <strong>.Excel (.xlsx / .xls)</strong>. El archivo puede tener los nombres de columna que quieras; en el siguiente paso vas a indicar a qué campo pertenece cada una.</p>
                </div>

                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  <div className="px-4 py-3 bg-background">
                    <p className="font-semibold text-dark">✉️ ¿Qué pasa si hay un email repetido?</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted"><strong className="text-dark">Dentro del archivo:</strong> Si el mismo email aparece dos veces en tu planilla, el sistema se queda con los datos de la última fila que encuentre y descarta la anterior.</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted"><strong className="text-dark">Contacto que ya existía:</strong> Si el email ya estaba cargado en el sistema, sus datos se van a <strong>actualizar</strong> con los del archivo. El contacto no se duplica, simplemente se sobreescribe con la información más reciente.</p>
                  </div>
                </div>

                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  <div className="px-4 py-3 bg-background">
                    <p className="font-semibold text-dark">📋 ¿Qué pasa con el Estado?</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">El sistema acepta el estado en cualquier formato. Por ejemplo, <code className="bg-background px-1 rounded">FUNCIONAL</code>, <code className="bg-background px-1 rounded">funcional</code> o <code className="bg-background px-1 rounded">Funcional</code> son lo mismo.</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">Los separadores tampoco importan: <code className="bg-background px-1 rounded">rebotado_inexistente</code>, <code className="bg-background px-1 rounded">rebotado-inexistente</code> y <code className="bg-background px-1 rounded">Rebotado Inexistente</code> se leen igual.</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">Si hay un pequeño error de tipeo como <code className="bg-background px-1 rounded">rebotado_span</code> en lugar de <em>spam</em>, el sistema lo reconoce igual.</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">Si el valor del estado no se puede reconocer, el contacto se importa con estado <strong className="text-dark">Funcional</strong> por defecto.</p>
                  </div>
                </div>

                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  <div className="px-4 py-3 bg-background">
                    <p className="font-semibold text-dark">🏭 ¿Qué pasa si el Rubro no se reconoce?</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">Si el rubro del archivo no coincide con ninguno de los rubros del sistema, el contacto se importa igual pero <strong className="text-dark">sin rubro asignado</strong>. Podrés asignárselo después desde el listado.</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">Tené en cuenta que a los contactos sin rubro <strong>solo les llegarán las campañas que se envíen a "Todos los rubros" o si marcás la opción "Sin rubro"</strong> al crear la campaña.</p>
                  </div>
                </div>

                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  <div className="px-4 py-3 bg-background">
                    <p className="font-semibold text-dark">🔖 ¿Qué pasa si el Tipo no es Principal ni Secundario?</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">Solo se reconocen los valores <strong className="text-dark">Principal</strong> y <strong className="text-dark">Secundario</strong>. Si el archivo tiene otro valor, o dejás la columna vacía, el contacto se importará como <strong className="text-dark">Principal</strong> por defecto.</p>
                  </div>
                </div>

                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                  <div className="px-4 py-3 bg-background">
                    <p className="font-semibold text-dark">❌ ¿Qué filas se saltan?</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-muted">Solo se ignoran las filas que <strong className="text-dark">no tienen un email válido</strong> (es decir, sin el símbolo @). Todas las demás se importan aunque les falten otros datos.</p>
                  </div>
                </div>

              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium transition-colors text-sm"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* PASO 0: Upload */}
          {paso === 0 && (
            <div className="space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertTriangle size={16} /> {errorMsg}
                </div>
              )}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-background/50'}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
                <Upload className={`mx-auto h-14 w-14 mb-4 transition-colors ${dragging ? 'text-primary' : 'text-muted'}`} />
                <p className="text-base font-semibold text-dark mb-1">Arrastrá y soltá tu archivo aquí</p>
                <p className="text-sm text-muted">o hacé clic para seleccionarlo</p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  {['.CSV', '.XLSX', '.XLS'].map(f => (
                    <span key={f} className="px-3 py-1 bg-background border border-border rounded-full text-xs text-muted font-medium">{f}</span>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                <strong>Tip:</strong> Tu archivo puede tener cualquier nombre de columna (Empresa, CUIT, Mail, Rubro, Tipo…). En el siguiente paso vas a mapear cada columna al campo correcto.
              </div>
            </div>
          )}

          {/* PASO 1: Mapear */}
          {paso === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">
                  Archivo: <span className="font-semibold text-dark">{fileName}</span> — <span className="font-semibold text-primary">{rows.length} filas</span> encontradas
                </p>
                <button onClick={() => { setPaso(0); setRows([]); setErrorMsg(''); }} className="text-xs text-muted hover:text-dark underline">
                  Cambiar archivo
                </button>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertTriangle size={16} /> {errorMsg}
                </div>
              )}

              {!emailsMapped && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertTriangle size={16} /> Debés mapear al menos una columna al campo <strong>Email</strong> para continuar.
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-background text-muted text-xs uppercase font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left">Columna del archivo</th>
                      <th className="px-4 py-3 text-left">Ejemplo</th>
                      <th className="px-4 py-3 text-left">Mapear a campo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mappings.map((m, i) => (
                      <tr key={m.colOriginal} className={`transition-colors ${m.campoDestino === '_ignorar' ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 font-medium text-dark">{m.colOriginal}</td>
                        <td className="px-4 py-3 text-muted text-xs max-w-[150px] truncate" title={String(rows[0]?.[m.colOriginal] ?? '')}>
                          {String(rows[0]?.[m.colOriginal] ?? '-')}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={m.campoDestino}
                            onChange={e => {
                              const updated = [...mappings];
                              updated[i] = { ...m, campoDestino: e.target.value as CampoDestino };
                              setMappings(updated);
                            }}
                            className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          >
                            {(Object.entries(CAMPO_LABELS) as [CampoDestino, string][]).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Preview */}
              {emailsMapped && validados.length > 0 && (
                <div>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-2">Vista previa (primeras 3 filas válidas)</p>
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-background border-b border-border text-muted font-semibold">
                        <tr>
                          {(['Email', 'Empresa', 'CUIT', 'Rubro', 'Tipo', 'Estado'] as const).map(h => (
                            <th key={h} className="px-3 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {validados.slice(0, 3).map((c, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-dark font-medium max-w-[160px] truncate">{c.email}</td>
                            <td className="px-3 py-2 text-muted max-w-[120px] truncate">{c.empresa_nombre || '-'}</td>
                            <td className="px-3 py-2 text-muted">{c.cuit || '-'}</td>
                            <td className="px-3 py-2 text-muted">{c.rubro_id ? (RUBROS_LABELS[c.rubro_id] || c.rubro_id) : '-'}</td>
                            <td className="px-3 py-2">
                              {c.tipo ? (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${c.tipo === 'principal' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${(c.estado || '').includes('rebotado') ? 'bg-red-50 text-red-600' : c.estado === 'inactivo' ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-700'}`}>
                                {c.estado || 'funcional'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted mt-2">
                    Se importarán <strong className="text-primary">{validados.length}</strong> contactos válidos de {rows.length} filas totales.
                    {rows.length - validados.length > 0 && <span className="text-amber-600"> ({rows.length - validados.length} sin email válido, serán ignoradas)</span>}
                    {emailsDuplicados > 0 && <span className="text-amber-600"> · {emailsDuplicados} email(s) duplicado(s) en el archivo, se importa solo el último.</span>}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PASO 2: Resultado */}
          {paso === 2 && result && (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={36} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-dark">¡Importación exitosa!</h3>
              <div className="flex items-center justify-center gap-8 mt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{result.procesados}</p>
                  <p className="text-sm text-muted">Filas procesadas</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{result.insertados_o_actualizados}</p>
                  <p className="text-sm text-muted">Creados / Actualizados</p>
                </div>
              </div>
              <p className="text-sm text-muted mt-2">Los contactos duplicados (mismo email) fueron actualizados automáticamente.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-between items-center shrink-0 bg-background/50">
          <button onClick={onClose} className="px-4 py-2 border border-border bg-background text-dark rounded-lg hover:bg-surface font-medium transition-colors text-sm">
            {paso === 2 ? 'Cerrar' : 'Cancelar'}
          </button>

          {paso === 1 && (
            <button
              onClick={handleImport}
              disabled={importing || !emailsMapped || validados.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium transition-colors text-sm disabled:opacity-50"
            >
              {importing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {importing ? 'Importando...' : `Importar ${validados.length} contactos`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
