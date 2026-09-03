import React, { useRef } from 'react'
import { Image as ImageIcon, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export interface AttachedImage {
  filename: string
  content: string // Base64 sem prefixo data:image/...;base64,
  content_type: string
  previewUrl: string // Para preview local no <img>
  sizeInBytes: number
}

interface ImageUploadFieldProps {
  image: AttachedImage | null
  onChange: (image: AttachedImage | null) => void
  disabled?: boolean
  maxSizeMB?: number
  label?: string
  helperText?: string
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DEFAULT_MAX_SIZE_MB = 5

export function ImageUploadField({
  image,
  onChange,
  disabled = false,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  label = 'Imagem da Campanha (Marketing)',
  helperText = 'Formatos suportados: JPG, PNG ou WEBP (máx. 5MB). A imagem será embutida no corpo do e-mail com destaque.',
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return

    // Limpar o input para permitir selecionar o mesmo arquivo novamente se necessário
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Validação de tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Formato inválido. Por favor, envie uma imagem nos formatos JPG, PNG ou WEBP.')
      return
    }

    // Validação de tamanho
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1)
      setError(
        `A imagem tem ${sizeFormatted}MB, o que excede o limite máximo permitido de ${maxSizeMB}MB.`,
      )
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Extrair o base64 puro removendo o header data:*/*;base64,
      const commaIndex = result.indexOf(',')
      const base64Content = commaIndex !== -1 ? result.substring(commaIndex + 1) : result

      onChange({
        filename: file.name,
        content: base64Content,
        content_type: file.type || 'image/png',
        previewUrl: result,
        sizeInBytes: file.size,
      })
    }
    reader.onerror = () => {
      setError('Erro ao ler a imagem. Tente novamente.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemove = () => {
    setError(null)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
          {label}
        </Label>
        {image && (
          <span className="text-[10px] font-medium text-slate-500">
            {(image.sizeInBytes / 1024).toFixed(0)} KB
          </span>
        )}
      </div>

      {!image ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 transition-colors rounded-lg p-3 text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group bg-white"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-slate-700">
              Clique para selecionar uma imagem
            </div>
            <p className="text-[10px] text-slate-500">{helperText}</p>
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs font-medium text-slate-700 truncate" title={image.filename}>
                {image.filename}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              className="h-6 w-6 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
              title="Remover imagem"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="relative rounded border bg-white overflow-hidden max-h-48 flex items-center justify-center">
            <img
              src={image.previewUrl}
              alt="Pré-visualização do anexo"
              className="object-contain max-h-48 w-full"
            />
          </div>

          <p className="text-[10px] text-slate-500 text-center">
            A imagem será embutida no corpo do e-mail junto ao texto e ao rodapé oficial.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
